const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || "localhost";

require("./chat.js")(app, port, host);

app.listen(port, () => console.log(`running on port ${port}`));