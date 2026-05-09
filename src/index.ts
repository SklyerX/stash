#!/usr/bin/env node

import readline from "node:readline";
import { stdin, stdout } from "node:process";
import { existsSync } from "node:fs";
import { STASH_DIR } from "./utils";
import { printWelcomeBanner } from "./display";
import { type Database } from "better-sqlite3-multiple-ciphers";
import chalk from "chalk";
import { getDatabase } from "./db";
import { CommandError, parseCommand } from "./command/parser";
import { CommandHandler } from "./command/handler";
import { printHelpTable } from "./tables";

let rl: readline.Interface;
let shuttingDown = false;
let db: Database;

function createRL() {
  rl = readline.createInterface({ input: stdin, output: stdout });
  rl.on("close", () => {
    if (shuttingDown) {
      if (db) db.close();

      console.log("\nGoodbye!");
      process.exit(0);
    }
  });
}

export function prompt(text = "stash> "): Promise<string> {
  return new Promise((resolve) => rl.question(text, resolve));
}


function promptPassword(text: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(text);
    let password = "";

    rl.close();

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const onData = (ch: string) => {
      if (ch === "\r" || ch === "\n") {
        stdin.removeListener("data", onData);
        stdin.setRawMode(false);
        stdin.pause();
        process.stdout.write("\n");
        createRL();
        resolve(password);
      } else if (ch === "\u0003") {
        process.exit();
      } else if (ch === "\u007f") {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write("\b \b");
        }
      } else {
        password += ch;
        process.stdout.write("*");
      }
    };

    stdin.on("data", onData);
  });
}

function destructiveAction(
  p = "Are you sure you want to delete all data? (Y/n) ",
) {
  return new Promise(async (resolve) => {
    console.log(chalk.yellow("[ WARNING ] This action is irreversible"));
    const answer = (await prompt(p)).trim().toUpperCase();

    if (answer === "YES" || answer === "Y") resolve(true);
    resolve(false);
  });
}

async function bootstrap() {
  console.clear();
  createRL();

  if (!existsSync(STASH_DIR)) {
    printWelcomeBanner();
    console.log(
      chalk.cyanBright(
        "[ * ] Welcome to stash! Please set a password to secure your database!",
      ),
    );
    console.log(
      chalk.yellow(
        "[ WARNING ] Remember the password, if you lose it the database will be inaccessible\n",
      ),
    );

    let password: string;
    let confirmPassword: string;

    do {
      password = await promptPassword("password> ");
      confirmPassword = await promptPassword("confirm-password> ");

      if (password !== confirmPassword) {
        console.log(chalk.red("[ ! ] Passwords do not match. Try again."));
      }
    } while (password !== confirmPassword);

    db = getDatabase(password);

    console.log(chalk.cyanBright("[ * ] Success! Continue!\n"));
  } else {
    const password = await promptPassword("password> ");
    db = getDatabase(password);
  }

  while (true) {
    const input = (await prompt()).trim();
    if (!input) continue;

    if (input.toUpperCase() === "BYE" || input.toUpperCase() === "EXIT") {
      shuttingDown = true;
      rl.close();
      db.close();
      break;
    }

    if (input.toUpperCase() === "HELP") {
      printHelpTable();
      continue;
    }

    if (input.toUpperCase() === "CLEAR") {
      console.clear();
    }

    try {
      const command = parseCommand(input);

      const handler = new CommandHandler(db);

      switch (command.command) {
        case "IMPORT":
          {
            if (!existsSync(command.path)) {
              console.log(chalk.red(`File not found: ${command.path}`));
              continue;
            }

            handler.import(command.path);
          }
          break;
        case "EXPORT":
          {
            handler.export();
          }
          break;
        case "NEWC":
          {
            handler.makeCollection(command.collection);
          }
          break;
        case "DELC":
          {
            const answer = await destructiveAction(
              "This will completely wipe this collection and all children links, this action is not reversible. Continue? (Y/n) ",
            );

            if (!answer) {
              console.log("Skipping DELC");
              continue;
            }

            handler.deleteCollection(command.collection);
          }
          break;
        case "LSC":
          await handler.showCollections();
          break;
        case "LS":
          await handler.showCollectionsLinks(command.collection);
          break;
        case "SAVE":
          await handler.save(command);
          break;
        case "SEARCH":
          handler.search(command.query);
          break;
        case "OPEN":
          handler.open(command);
          break;
        case "OPENL":
          handler.open(command, true);
          break;
        case "DEL":
          {
            const answer = await destructiveAction(
              "This will delete this link and any downloaded content that belongs to this link, this action is not reversible. Continue? (Y/n) ",
            );

            if (!answer) {
              console.log("Skipping DEL");
              continue;
            }

            handler.deleteLink(command);
          }
          break;
        case "WIPE": {
          const answer = await destructiveAction(
            "This will wipe all data and leave you with a fresh account. Continue (Y/n) ",
          );

          if (!answer) {
            console.log("Skipped wipe command");
            continue;
          }

          handler.wipe();
          process.exit();
        }
        case "FLUSHALL":
          {
            const answer = await destructiveAction();

            if (!answer) {
              console.log("Skipped flush command");
              continue;
            }

            handler.flushall();
            console.log("Database flushed");
          }
          break;
      }
    } catch (err) {
      if (err instanceof CommandError) {
        setTimeout(async () => {
          console.log(chalk.red(err.message));
          console.clear();
          await prompt();
        }, err.delayBeforeClear ?? 700);
      } else {
        console.error(err);
      }
    }
  }
}

bootstrap();
