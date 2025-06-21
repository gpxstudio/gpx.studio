export enum SplitType {
    FILES = 'files',
    TRACKS = 'tracks',
    SEGMENTS = 'segments',
}

export let splitAs = $state({
    current: SplitType.FILES,
});
