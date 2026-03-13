import amqp from "amqplib";
import { AckType, publishJSON, SimpleQueueType, subscribeMsgPack } from "../internal/pubsub/pubsub.js";
import { ExchangePerilDirect, ExchangePerilTopic, GameLogSlug, PauseKey } from "../internal/routing/routing.js";
import { getInput, printServerHelp } from "../internal/gamelogic/gamelogic.js";
// import { handlerLogs } from "../client/handlers.js";
import { writeLog, type GameLog } from "../internal/gamelogic/logs.js";

async function main() {
  console.log("Starting Peril server...");
  const rabbitUrl = "amqp://guest:guest@localhost:5672/";

  const conn = await amqp.connect(rabbitUrl);
  console.log("Connection successful.");
  const confirm = await conn.createConfirmChannel();

  await subscribeMsgPack(conn, ExchangePerilTopic, `${GameLogSlug}`, `${GameLogSlug}.*`, SimpleQueueType.Durable, async (gl: GameLog) => {
    try {
            await writeLog(gl);
            process.stdout.write("> ");
            return AckType.Ack;
        } catch(err) {
            console.log("Error writing log: ", err);
            return AckType.NackRequeue;
        }
  });

  if(!process.stdin.isTTY){
    console.log("Non-interactive mode: skipping command input.");
    return;
  }

  printServerHelp();

  while(true){
    const input = await getInput();
    if(input.length != 0){
      if(input[0] == "pause"){
        console.log("Pausing game...");
        await publishJSON(confirm, ExchangePerilDirect, PauseKey, { isPaused: true });
      } else if(input[0] == "resume"){
        console.log("Resuming game...");
        await publishJSON(confirm, ExchangePerilDirect, PauseKey, { isPaused: false });
      } else if(input[0] == "quit"){
        console.log("Ending game...");
        console.log("\nExit signal detected.\nShutting down server...");
        try {
          await conn.close();
        } catch(err){
          console.log((err as Error).message);
          process.exit(1);
        }
        console.log("Sever safely shut down.");
        process.exit(0);
      } else if(input[0] == "help"){
        printServerHelp();
      } else {
        console.log("Not a valid command");
      }
    }
  }

}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
