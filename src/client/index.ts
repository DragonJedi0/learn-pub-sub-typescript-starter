import amqp from "amqplib";
import { clientWelcome, commandStatus, getInput, printClientHelp, printQuit } from "../internal/gamelogic/gamelogic.js";
import { declareAndBind, SimpleQueueType, subscribeJSON } from "../internal/pubsub/pubsub.js";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";
import { GameState } from "../internal/gamelogic/gamestate.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove } from "../internal/gamelogic/move.js";
import { handlerPause } from "./handlers.js";

async function main() {
  console.log("Starting Peril client...");
  const rabbitUrl = "amqp://guest:guest@localhost:5672/";
  
  const conn = await amqp.connect(rabbitUrl);
  console.log("Connection successful.");

  const username = await clientWelcome();

  await declareAndBind(conn, ExchangePerilDirect, `pause.${username}`, PauseKey, SimpleQueueType.Transient);

  const state = new GameState(username);

  await subscribeJSON(conn, ExchangePerilDirect, `pause.${username}`, PauseKey, SimpleQueueType.Transient, handlerPause(state));

  while(true){
    const input = await getInput("Enter command: ");
    if(input.length != 0){
      if(input[0] == "spawn"){
        console.log(`Spawning ${input[2]} in ${input[1]}...`);
        try{
          commandSpawn(state, input);
        } catch(err){
          console.log((err as Error).message);
        }
      } else if(input[0] == "move"){
        console.log(`Moving unit ${input[2]} to ${input[1]}...`);
        try{
          commandMove(state, input);
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

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
