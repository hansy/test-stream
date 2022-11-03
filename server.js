require("dotenv").config();
const express = require("express");
const Queue = require("bull");
const { createBullBoard } = require("@bull-board/api");
const { BullAdapter } = require("@bull-board/api/bullAdapter");
const { ExpressAdapter } = require("@bull-board/express");
const bodyParser = require("body-parser");

const PORT = process.env.PORT || "5000";
const REDIS_URL = process.env.REDISCLOUD_URL || "redis://127.0.0.1:6379";

const app = express();
app.use(bodyParser.json());
const workQueue = new Queue("testStream", REDIS_URL);
const serverAdapter = new ExpressAdapter();

serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullAdapter(workQueue)],
  serverAdapter: serverAdapter,
});

app.use("/admin/queues", serverAdapter.getRouter());

app.get("/", (req, res) => res.sendFile("index.html", { root: __dirname }));

app.post("/stream", async (req, res) => {
  const { streamKey } = req.body;
  const job = await workQueue.getJob(streamKey);

  if (job) {
    const progress = job._progress;

    if (progress === "bad key") {
      return res.json({ status: "bad key" });
    }

    if (progress !== "running") {
      console.log("Old job found; removing...");
      await job.remove();
    } else {
      console.log("Job already running");
      return res.json({ status: "running" });
    }
  }

  console.log("Adding new job to queue");
  await workQueue.add({ streamKey }, { jobId: streamKey });

  res.json({ status: "started" });
});

app.listen(PORT, () => console.log(`Server started on port ${PORT}!`));
