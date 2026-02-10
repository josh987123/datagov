import { app } from "./app.js";
import { env } from "./config.js";

app.listen(env.API_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${env.API_PORT}`);
});
