import amqp from "amqplib";
import { clientWelcome, commandStatus, getInput, printClientHelp, printQuit } from "../internal/gamelogic/gamelogic.js";
import { publishJSON, publishMsgPack, SimpleQueueType, subscribeJSON, subscribeMsgPack } from "../internal/pubsub/pubsub.js";
import { ArmyMovesPrefix, ExchangePerilDirect, ExchangePerilTopic, GameLogSlug, PauseKey, WarRecognitionsPrefix } from "../internal/routing/routing.js";
import { GameState } from "../internal/gamelogic/gamestate.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove } from "../internal/gamelogic/move.js";
import { handlerMove, handlerPause, handlerWar } from "./handlers.js";
import { type GameLog } from "../internal/gamelogic/logs.js";

async function main() {
  console.log("Starting Peril client...");
  const rabbitUrl = "amqp://guest:guest@localhost:5672/";
  
  const conn = await amqp.connect(rabbitUrl);
  console.log("Connection successful.");
  
  const confirmChannel = await conn.createConfirmChannel();

  const username = await clientWelcome();

  const state = new GameState(username);

  await subscribeJSON(conn, ExchangePerilDirect, `pause.${username}`, PauseKey, SimpleQueueType.Transient, handlerPause(state));
  await subscribeJSON(conn, ExchangePerilTopic, `${ArmyMovesPrefix}.${username}`, `${ArmyMovesPrefix}.*`, SimpleQueueType.Transient, handlerMove(state, confirmChannel));
  await subscribeJSON(conn, ExchangePerilTopic, `${WarRecognitionsPrefix}`, `${WarRecognitionsPrefix}.*`, SimpleQueueType.Durable, handlerWar(state, confirmChannel));

  while(true){
    const input = await getInput();
    if(input.length != 0){
      if(input[0] == "spawn"){
        console.log(`Spawning ${input[2]} in ${input[1]}...`);
        try{
          commandSpawn(state, input);
        } catch(err){
          console.log((err as Error).message);
        }
      } else if(input[0] == "move"){
        console.log(`Moving unit(s) to ${input[1]}...`);
        try{
          const army_move = commandMove(state, input);
          await publishJSON(confirmChannel, ExchangePerilTopic, `${ArmyMovesPrefix}.${username}`, army_move);
          console.log("Move published successfully");
        } catch(err){
          console.log((err as Error).message);
        }
      } else if(input[0] == "status"){
        await commandStatus(state);
      } else if (input[0] == "help"){
        printClientHelp();
      } else if (input[0] == "spam"){
        console.log("Spamming not alllowed!");
      } else if (input[0] == "quit"){
        printQuit();
        process.exit(0);
      } else {
        console.log("Not a valid command");
      }
    }
  }
}

export async function publishGameLog(ch: amqp.ConfirmChannel, username: string, message: string){
  const log: GameLog = {
    currentTime: new Date(),
    message: message,
    username: username,
  };
  await publishMsgPack(ch, ExchangePerilTopic, `${GameLogSlug}.${username}`, log);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
