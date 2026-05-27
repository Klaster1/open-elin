export const ExitCode = {
  Success: 0,
  GeneralError: 1,
  InvalidArgs: 2,
  BleUnavailable: 3,
  HubNotFound: 4,
  ConnectFailed: 5,
  CommandFailed: 6,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];
