/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Suryanshu Nabheet All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export interface ICodexSCMService {
	readonly _serviceBrand: undefined;
	/**
	 * Get git diff --stat
	 *
	 * @param path Path to the git repository
	 */
	gitStat(path: string): Promise<string>
	/**
	 * Get git diff --stat for the top 10 most significantly changed files according to lines added/removed
	 *
	 * @param path Path to the git repository
	 */
	gitSampledDiffs(path: string): Promise<string>
	/**
	 * Get the current git branch
	 *
	 * @param path Path to the git repository
	 */
	gitBranch(path: string): Promise<string>
	/**
	 * Get the last 5 commits excluding merges
	 *
	 * @param path Path to the git repository
	 */
	gitLog(path: string): Promise<string>
	/**
	 * Get all git branches
	 *
	 * @param path Path to the git repository
	 */
	gitBranches(path: string): Promise<string[]>
	/**
	 * Get recent git commits
	 *
	 * @param path Path to the git repository
	 * @param limit Maximum number of commits to return
	 */
	/**
	 * Get recent git commits
	 *
	 * @param path Path to the git repository
	 * @param limit Maximum number of commits to return
	 */
	gitRecentCommits(path: string, limit?: number): Promise<{ hash: string, message: string }[]>
	/**
	 * Get git show --stat for a specific commit
	 *
	 * @param path Path to the git repository
	 * @param hash Commit hash
	 */
	gitShow(path: string, hash: string): Promise<string>
}

export const ICodexSCMService = createDecorator<ICodexSCMService>('codexSCMService')
