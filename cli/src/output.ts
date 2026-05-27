import process from "node:process";
import { ExitCode } from "./exit-codes.ts";

const useColor = process.stdout.isTTY && !process.env["NO_COLOR"];

export function printJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

export function printLine(text: string): void {
  process.stdout.write(text + "\n");
}

export function printError(message: string): void {
  process.stderr.write(
    (useColor ? "\x1b[31merror\x1b[0m: " : "error: ") + message + "\n",
  );
}

export function die(message: string, code: number = ExitCode.GeneralError): never {
  printError(message);
  process.exit(code);
}
