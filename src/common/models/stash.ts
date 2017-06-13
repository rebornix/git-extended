import { GitChangeType } from './file';

export class Stash {
    public readonly id: string;
    public readonly sha: string;
    public readonly parentHash: string;
    public readonly message: string;

    constructor(id: string, hash: string, parentHash: string, message: string) {
        this.id = id;
        this.sha = hash;
        this.parentHash = parentHash;
        this.message = message;
    }
}

export class StashFile {
    public commitSha: string;
    public status: GitChangeType;
    public path: string;
    public originalPath?: string;

    constructor(commitSha: string, status: GitChangeType, path: string, originalPath?: string) {
        this.commitSha = commitSha;
        this.status = status;
        this.path = path;
        if (originalPath !== undefined) {
            this.originalPath = originalPath;
        }
    }
}