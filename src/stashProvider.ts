import * as path from 'path';
import * as vscode from 'vscode';

import { getStashes, applyStash, popStash, dropStash, getChangedFilesInStash } from './common/stash';
import { getFile } from './common/file';
import { Stash, StashFile } from './common/models/stash';
import { GitChangeType } from './common/models/file';
import { Repository } from './common//models/repository';
import { getParentCommit } from './common/log';

export class StashProvider implements vscode.TreeDataProvider<Stash | StashFile> {
    private context: vscode.ExtensionContext;
    private workspaceRoot: string;
    private repository: Repository;
    private _onDidChangeTreeData: vscode.EventEmitter<Stash | undefined> = new vscode.EventEmitter<Stash | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Stash | undefined> = this._onDidChangeTreeData.event;
    private icons: any;
    
    active(context: vscode.ExtensionContext, workspaceRoot: string) {
        this.context = context;
        this.workspaceRoot = workspaceRoot;
        this.repository = new Repository(this.workspaceRoot);

        vscode.window.registerTreeDataProvider<Stash | StashFile>('stash', this);

        this.icons = {
            light: {
                Modified: context.asAbsolutePath(path.join('resources', 'icons', 'light', 'status-modified.svg')),
                Added: context.asAbsolutePath(path.join('resources', 'icons', 'light', 'status-added.svg')),
                Deleted: context.asAbsolutePath(path.join('resources', 'icons', 'light', 'status-deleted.svg')),
                Renamed: context.asAbsolutePath(path.join('resources', 'icons', 'light', 'status-renamed.svg')),
                Copied: context.asAbsolutePath(path.join('resources', 'icons', 'light', 'status-copied.svg')),
                Untracked: context.asAbsolutePath(path.join('resources', 'icons', 'light', 'status-untrackedt.svg')),
                Ignored: context.asAbsolutePath(path.join('resources', 'icons', 'light', 'status-ignored.svg')),
                Conflict: context.asAbsolutePath(path.join('resources', 'icons', 'light', 'status-conflict.svg')),
            },
            dark: {
                Modified: context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'status-modified.svg')),
                Added: context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'status-added.svg')),
                Deleted: context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'status-deleted.svg')),
                Renamed: context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'status-renamed.svg')),
                Copied: context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'status-copied.svg')), 
                Untracked: context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'status-untracked.svg')),
                Ignored: context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'status-ignored.svg')),
                Conflict: context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'status-conflict.svg'))
            }
		};
        
        vscode.commands.registerCommand('stash.apply', async (element: Stash) => {
            await applyStash(this.repository, element.id);
            this._onDidChangeTreeData.fire();
        });
        vscode.commands.registerCommand('stash.pop', async (element: Stash) => {
            await popStash(this.repository, element.id);
            this._onDidChangeTreeData.fire();
        });
        vscode.commands.registerCommand('stash.delete', async (element: Stash) => {
            await dropStash(this.repository, element.id);
            this._onDidChangeTreeData.fire();
        });
        vscode.commands.registerCommand('stash.diff', async (element: StashFile) => {
            if (element.status === GitChangeType.MODIFY) {
                let right = await getFile(element.commitSha, element.path);
                let parentSha = await getParentCommit(this.repository, element.commitSha);
                let left = await getFile(parentSha, element.path);

                vscode.commands.executeCommand('vscode.diff', 
                    vscode.Uri.file(path.resolve(this.workspaceRoot, left)),
                    vscode.Uri.file(path.resolve(this.workspaceRoot, right)),
                    `${parentSha.substr(0, 7)} .. ${element.commitSha.substr(0, 7)}`);
            } else if (element.status === GitChangeType.DELETE) {
                let parentSha = await getParentCommit(this.repository, element.commitSha);
                let left = await getFile(parentSha, element.path);
                vscode.commands.executeCommand('vscode.open', vscode.Uri.file(path.resolve(this.workspaceRoot, left)));
            } else {
                let right = await getFile(element.commitSha, element.path);                
                vscode.commands.executeCommand('vscode.open', vscode.Uri.file(path.resolve(this.workspaceRoot, right)));
            }
        });
    }

    getTreeItem(element: Stash | StashFile): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (element instanceof Stash) {
            return {
                label: element.message,
                collapsibleState: 1
            };
        } else {
            return new Promise(async resolve => {
                // let left = await getFile(element.originalFilePath, element.originalContent);
                // let right = await getFile(element.filePath, element.content);
                let iconUri: string;
                let iconDarkUri: string;

                switch(element.status) {
                    case GitChangeType.ADD:
                        iconUri = this.icons.light.Added;
                        iconDarkUri = this.icons.dark.Added;
                        break;
                    case GitChangeType.COPY:
                        iconUri = this.icons.light.Copied;
                        iconDarkUri = this.icons.dark.Copied;
                        break;
                    case GitChangeType.DELETE:
                        iconUri = this.icons.light.Deleted;
                        iconDarkUri = this.icons.dark.Deleted;
                        break;
                    case GitChangeType.MODIFY:
                        iconUri = this.icons.light.Modified;
                        iconDarkUri = this.icons.dark.Modified;
                        break;
                    case GitChangeType.RENAME:
                        iconUri = this.icons.light.Renamed;
                        iconDarkUri = this.icons.dark.Renamed;
                        break;
                }
                
                let newElement: vscode.TreeItem = {
                    label: element.status === GitChangeType.RENAME ? `${element.originalPath} -> ${element.path}` : element.path,
                    command: {
                        title: 'show stash diff',
                        command: 'stash.diff',
                        arguments: [
                            element
                        ]
                    },
                    iconPath: {
                        light: iconUri,
                        dark: iconDarkUri
                    }
                };
                resolve(newElement);
            });
        }
    }

    getChildren(element?: Stash | StashFile): Stash[] | Thenable<Stash[]> | StashFile[] | Thenable<StashFile[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No stashes in empty workspace');
            return Promise.resolve([]);
        }

        if (element) {
            if (element instanceof Stash) {
                return getChangedFilesInStash(this.repository, element, element.sha);
            } else {
                return Promise.resolve([]);
            }
        } else {
            return getStashes(this.repository).then((stashes) => {
                return stashes;
            });
        }
    }
}