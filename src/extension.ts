'use strict';

import * as vscode from 'vscode';
import { CommitsProvider } from './commitsProvider';
import { StashProvider } from './stashProvider';

export function activate(context: vscode.ExtensionContext) {
	const rootPath = vscode.workspace.rootPath;
	new CommitsProvider().active(context, rootPath);
	new StashProvider().active(context, rootPath);
}
