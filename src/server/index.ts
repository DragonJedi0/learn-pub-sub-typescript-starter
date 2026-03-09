import amqp from "amqplib";
import { declareAndBind, publishJSON, SimpleQueueType } from "../internal/pubsub/pubsub.js";
import { ExchangePerilDirect, ExchangePerilTopic, GameLogSlug, PauseKey } from "../internal/routing/routing.js";
import { getInput, printServerHelp } from "../internal/gamelogic/gamelogic.js";

async function main() {
  console.log("Starting Peril server...");
  const rabbitUrl = "amqp://guest:guest@localhost:5672/";

  const conn = await amqp.connect(rabbitUrl);
  console.log("Connection successful.");

  printServerHelp();
  const confirm = await conn.createConfirmChannel();

  await declareAndBind(conn, ExchangePerilTopic, "game_logs", GameLogSlug, SimpleQueueType.Durable);

  while(true){
    const input = await getInput("Enter command: ");
    if(input.length != 0){
      if(input[0] == "pause"){
        console.log("Pausing game...");
        await publishJSON(confirm, ExchangePerilDirect, PauseKey, { isPaused: true });
      } else if(input[0] == "resume"){
        console.log("Resuming game...");
        await publishJSON(confirm, ExchangePerilDirect, PauseKey, { isPaused: false });
      } else if(input[0] == "quit"){
        console.log("Ending game...");
        break;
      } else if(input[0] == "help"){
        printServerHelp();
      } else {
        console.log("Not a valid command");
      }
    }
  }
  
  process.on('exit', () => {
    console.log("\nExit signal detected.\nShutting down server...");
    conn.close();
    console.log("Sever safely shut down.");
  });

}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
