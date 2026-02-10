import { app } from "./app.js";
import { env } from "./config.js";
import { maybeRunStartupIngest } from "./bootstrap.js";

const port = Number(process.env.PORT ?? env.API_PORT);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on port ${port}`);

  // Run a one-time background ingest on first boot when DB is empty.
  void maybeRunStartupIngest();
});
