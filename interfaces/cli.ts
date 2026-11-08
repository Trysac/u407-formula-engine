export interface CLIOutput {
  stdout: { write(s: string): void };
  stderr: { write(s: string): void };
}

export declare function run(argv: string[], io: CLIOutput): Promise<number>;
