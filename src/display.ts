import figlet from "figlet";

export function printWelcomeBanner() {
  console.log(figlet.textSync("Welcome to Stash", { font: "ANSI Shadow" }));
}
