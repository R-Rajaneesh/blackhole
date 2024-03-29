import * as glob from "globby";
import * as socket from "socket.io";
import apiRouter from "./routes/ads.js";
import cors from "cors";
import dns2 from "dns2";
import express from "express";
import fs from "fs-extra";
import helmet from "helmet";
import http from "http";
import p from "path";
import sql from "./database/db.js";
import url from "url";
import axios from "axios";

let adsBlocked = 0;
if (!sql.prepare(`SELECT * FROM gravity`).all().length) {
  await axios({ method: "delete", url: "http://127.0.0.1:80/reset" });
}
sql.prepare(`CREATE TABLE IF NOT EXISTS gravity (type INTEGER PRIMARYKEY, domain TEXT UNIQUE, redirect text DEFAULT "0.0.0.0")`).run();
sql.prepare(`CREATE TABLE IF NOT EXISTS counter (count INTEGER PRIMARY KEY)`).run();

/* Handle Process Exit */
[
  "beforeExit",
  "exit",
  "rejectionHandled",
  "uncaughtException",
  "uncaughtExceptionMonitor",
  "unhandledRejection",
  "warning",
  "SIGABRT",
  "SIGALRM",
  "SIGBUS",
  "SIGCHLD",
  "SIGCONT",
  "SIGFPE",
  "SIGHUP",
  "SIGILL",
  "SIGINT",
  "SIGIO",
  "SIGIOT",
  "SIGKILL",
  "SIGPIPE",
  "SIGPOLL",
  "SIGPROF",
  "SIGPWR",
  "SIGQUIT",
  "SIGSEGV",
  "SIGSTKFLT",
  "SIGSTOP",
  "SIGSYS",
  "SIGTERM",
  "SIGTRAP",
  "SIGTSTP",
  "SIGTTIN",
  "SIGTTOU",
  "SIGUNUSED",
  "SIGURG",
  "SIGUSR1",
  "SIGUSR2",
  "SIGVTALRM",
  "SIGWINCH",
  "SIGXCPU",
  "SIGXFSZ",
  "SIGBREAK",
  "SIGLOST",
  "SIGINFO",
].forEach((eventName: string) => {
  process.on(eventName, () => {
    process.stdin.resume();
    sql.prepare(`UPDATE counter SET count = (count + ?)`).run(adsBlocked);
    setTimeout(() => {
      process.exit(1);
    }, 2000);
  });
});

const __dirname = p.dirname(url.fileURLToPath(import.meta.url));
const { Packet } = dns2;

const app = express();
const server = http.createServer(app);
const io = new socket.Server();
io.attach(server);

// * DNS Initialiser
const dns = dns2.createServer({
  udp: true,
  tcp: true,
  handle: async (request, send, rinfo) => {
    const response = Packet.createResponseFromRequest(request);

    const question: any = request.questions[0];
    const { name: domain } = question;
    question.type = Packet.TYPE.A;
    question.class = Packet.CLASS.IN;
    async function blockDomain(ad: any) {
      const res: any = {
        domain: domain,
        name: domain,
        type: Packet.TYPE.A,
        ttl: 0,
        class: Packet.CLASS.IN,
        address: "0.0.0.0",
        allowed: 0,
      };
      response.answers.push(res);
      io.emit("dns-query", response);
      const count = sql.prepare("SELECT * FROM counter").all();
      if (!count.length) {
        sql.prepare(`INSERT INTO counter (count) VALUES (?)`).run(1);
      } else {
        adsBlocked += 1;
      }
      // console.log(`Blocked domain ${domain}\n`);
      send(response);
    }
    async function allowDomain(ad: any) {
      Promise.resolve(await new dns2().resolveA(domain))
        .then(async (res) => {
          res.answers.forEach(async (ans) => {
            // console.log(ad);
            if (ad?.type === 0) {
              ans.ttl = 0;
              ans.address = "0.0.0.0";
              ans.allowed = false;
            } else {
              ans.allowed = true;
            }
          });
          response.answers = res.answers;
          io.emit("dns-query", response);
          send(response);
        })
        .catch(() => {});
    }

    const ad = sql.prepare(`SELECT * FROM gravity WHERE domain = (?)`).get(domain);
    if (!ad) sql.prepare(`INSERT INTO gravity (type, domain, redirect) VALUES (?, ?, ?)`).run(1, domain, "0.0.0.0");
    console.log(domain, sql.prepare(`SELECT * FROM gravity WHERE domain = (?)`).get(domain));
    if (ad?.type) {
      allowDomain(ad);
    } else {
      blockDomain(ad);
    }
  },
});

app.set("view engine", "ejs");
app.set("trust proxy", 1);
app.set("views", "src/views");
app.use(cors({ origin: "*", optionsSuccessStatus: 200 }));
app.use(helmet());
app.use(express.json());
app.use(express.static(p.join(__dirname, "public")));
app.use(express.static(p.join(__dirname, "source")));
app.use("/api", apiRouter);
app.use(async (req, res, next) => {
  res.setHeader("x-powered-by", "blackhole");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Security-Policy", "");

  next();
});

glob.globby("src/views/**").then((paths) => {
  paths.forEach(async (path) => {
    /* Watch file changes */
    fs.watchFile(path, (currentState, previousState) => {
      io.emit("page-reload");
    });

    /* Process file path and server file path destination */
    if (!path || !path.length) return;
    if (path.split("/")[2].startsWith("!")) return;
    let serverPath = "";
    let Path: string[] = path.split("/");
    if (!Path.length) return;
    if (/index.(ejs|html)/g.test(path.split("/").pop() as string)) Path.pop();
    serverPath = `/${Path.join("/")}`;
    serverPath = serverPath.replace("/src/views", "");
    if (!serverPath.length) serverPath = "/";

    path = path.replace("src/views/", "");
    console.log(serverPath, path);
    app.get(serverPath, (req, res) => {
      if (!path.endsWith(".html")) return res.render(path);
      return res.sendFile(p.resolve(`${path}`));
    });
  });
});

// * DNS Handler
dns.on("request", (request, response, rinfo) => {});
dns.on("requestError", (error) => {
  console.log("Client sent an invalid request", error);
});

dns.on("listening", () => {
  console.log(
    ` Listening to ${Object.keys(dns.addresses())
      .map((v) => v.toUpperCase())
      .join(" and ")} on port 53 `,
  );
});

dns.on("close", () => {
  console.log("server closed");
});

/* Start the servers */
server.listen(80, "0.0.0.0", () => {
  dns.listen({ tcp: 53, udp: 53 });
  console.log("Server running on http://127.0.0.1");
});
