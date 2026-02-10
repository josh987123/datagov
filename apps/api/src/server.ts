import { app } from "./app.js";
import { env } from "./config.js";

const port = Number(process.env.PORT ?? env.API_PORT);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on port ${port}`);
});
