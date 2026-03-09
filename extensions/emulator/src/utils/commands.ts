import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export const runCmd = async (cmd: string, options: any = {}): Promise<string> => {
	try {
		const { stdout } = await execAsync(cmd, options);
		return (stdout as unknown) as string;
	} catch (err) {
		const { stdout } = await execAsync(cmd);
		return (stdout as unknown) as string;
	}
};
