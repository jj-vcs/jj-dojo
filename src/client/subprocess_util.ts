import childProcess from 'node:child_process';
import util from 'node:util';

const execFile = util.promisify(childProcess.execFile);

export async function subprocess(options: {
  cwd: string;
  command: string;
  args?: string[];
}): Promise<{
  stdout: string;
  stderr: string;
}> {
  const {cwd, command, args} = options;
  return execFile(command, args, {cwd, timeout: 3000});
}
