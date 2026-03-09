import amqp from "amqplib";
import { clientWelcome } from "../internal/gamelogic/gamelogic.js";
import { declareAndBind, SimpleQueueType } from "../internal/pubsub/pubsub.js";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";

async function main() {
  console.log("Starting Peril client...");
  const rabbitUrl = "amqp://guest:guest@localhost:5672/";
  
  const conn = await amqp.connect(rabbitUrl);
  console.log("Connection successful.");

  const username = await clientWelcome();

  await declareAndBind(conn, ExchangePerilDirect, `pause.${username}`, PauseKey, SimpleQueueType.Transient)
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
