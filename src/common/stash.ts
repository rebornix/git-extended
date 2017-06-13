import { GitProcess } from 'dugite';
import { Stash, StashFile } from './models/stash';
import { SlimFileChange, GitChangeType, fromStatus } from './models/file';
import { Repository } from './models/repository';
import { getFileContent} from './file';
import { getParentCommit } from './log';

// stashinfo format: stash@{0}b4a6d30dcdOn master: SearchInMultipleSelections
const stashInfoRegex = /^(stash@\{\d+\}) ([0-9a-f]{5,40}) ([0-9a-f]{5,40})? (.*)$/;

export async function getStashes(repository: Repository): Promise<ReadonlyArray<Stash>> {
    const prettyFormat = [
        '%gd', // shortened reflog selector
        '%h', // abbreviated commit hash
        '%p', // abbreviated parent hash
        '%s' // summary
    ].join(' ');

    const result = await GitProcess.exec([
        'stash',
        'list',
        `--pretty=${prettyFormat}`
    ], repository.path);
    
    const out = result.stdout
    const lines = out.split('\n')
    // Remove the trailing empty line
    lines.splice(-1, 1);
    const stashes = lines.map(line => {
        // stash@{0}b4a6d30dcdOn master: SearchInMultipleSelections
        const matches = stashInfoRegex.exec(line);
        return new Stash(
            matches[1],
            matches[2],
            matches[3],
            matches[4]
        );
    })
    return stashes;
}
export async function applyStash(repository: Repository, stashId: string): Promise<void> {
    const result = await GitProcess.exec([
        'stash',
        'apply',
        stashId
    ], repository.path);

    if (result.exitCode !== 0) {
        throw(result.stderr);
    }
}
export async function popStash(repository: Repository, stashId: string): Promise<void> {
    await GitProcess.exec([
        'stash',
        'pop',
        stashId
    ], repository.path);
}
export async function dropStash(repository: Repository, stashId: string): Promise<void> {
    const result = await GitProcess.exec([
        'stash',
        'drop',
        stashId
    ], repository.path);
    
    if (result.exitCode !== 0) {
        throw(result.stderr);
    }
}
export async function saveStash(repository: Repository): Promise<void> {
    const result = await GitProcess.exec([
        'stash',
        'save'
    ], repository.path);
    
    if (result.exitCode !== 0) {
        throw(result.stderr);
    }
}

export async function getChangedFilesInStash(repository: Repository, stash: Stash, commitSha: string): Promise<StashFile[]> {
    const result = await GitProcess.exec([
        'stash',
        'show',
        '-p',
        stash.id,
        '--name-status',
        '-z'
    ], repository.path);

    const out = result.stdout;
    let lines = out.split('\0');
    lines.splice(-1, 1);
    let files: StashFile[] = [];
    for (let i = 0, len = lines.length; i < len; i++) {
        const statusFlag = lines[i];
        const status = fromStatus(statusFlag);

        let originalPath: string | undefined = undefined;
        if (status === GitChangeType.RENAME || status === GitChangeType.COPY) {
            originalPath = lines[++i];
        }

        let path = lines[++i];
        files.push(new StashFile(commitSha, status, path, originalPath));
    }

    return files;
}
export async function getStashDetails(repository: Repository, rootDir: string, stashId: string, commitSha: string): Promise<SlimFileChange[]> {
    const result = await GitProcess.exec([
        'stash',
        'show',
        '-p',
        '-U0',
        stashId
    ], repository.path)

    const out = result.stdout
    let reg = /diff((?!diff).*\n*)*/g
    let match = reg.exec(out);
    let slimFileChanges: SlimFileChange[] = [];

    while(match) {
        let singleFileDiff = match[0];
        let diffInfo = /diff --git a\/(\S+) b\/(\S+).*\n*index.*\n*-{3}.*\n*\+{3}.*\n*((.*\n*)+)/.exec(singleFileDiff);
        let a = diffInfo[1];
        let b = diffInfo[2];
        let right = await getFileContent(rootDir, commitSha, a);
        let parentCommit = await getParentCommit(repository, commitSha);
        let left = await getFileContent(rootDir, parentCommit, a);
        let slimFileChange = new SlimFileChange(b, a, GitChangeType.MODIFY);
        slimFileChange.originalContent = left;
        slimFileChange.content = right;
        slimFileChanges.push(slimFileChange);

        match = reg.exec(out);
    }

    return slimFileChanges;
}
