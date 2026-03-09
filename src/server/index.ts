import amqp from "amqplib";
import { publishJSON } from "../internal/pubsub/pubsub.js";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";

async function main() {
  console.log("Starting Peril server...");
  const rabbitUrl = "amqp://guest:guest@localhost:5672/";

  const conn = await amqp.connect(rabbitUrl);
  console.log("Connection successful.");

  const confirm = await conn.createConfirmChannel();

  await publishJSON(confirm, ExchangePerilDirect, PauseKey, { isPaused: true });

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
