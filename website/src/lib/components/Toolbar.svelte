<script lang="ts">
	import ToolbarItem from './ToolbarItem.svelte';
	import Fa from 'svelte-fa';
	import {
		faPencil,
		faStopwatch,
		faExchange,
		faPlusCircle,
		faListUl,
		faCopy,
		faMapMarkerAlt,
		faCompressAlt,
		faVectorSquare,
		faEyeSlash,
		faPalette,
		faFolderTree,
		faTrashAlt
	} from '@fortawesome/free-solid-svg-icons';
</script>

<div class="absolute top-0 bottom-0 left-0 z-10 flex flex-col justify-center pointer-events-none">
	<div class="flex flex-col p-1 gap-1 bg-background rounded-md pointer-events-auto shadow-md">
		<ToolbarItem>
			<Fa slot="icon" icon={faPencil} />
			<span slot="tooltip">Edit the track points</span>
		</ToolbarItem>
		<ToolbarItem>
			<Fa slot="icon" icon={faStopwatch} />
			<span slot="tooltip">Change time and speed data</span>
		</ToolbarItem>
		<ToolbarItem>
			<Fa slot="icon" icon={faExchange} />
			<span slot="tooltip">Reverse the order of the track points</span>
		</ToolbarItem>
		<ToolbarItem>
			<Fa slot="icon" icon={faPlusCircle} />
			<span slot="tooltip">Merge with another file</span>
		</ToolbarItem>
		<ToolbarItem>
			<Fa slot="icon" icon={faListUl} />
			<span slot="tooltip">Extract the tracks or track segments to new files</span>
		</ToolbarItem>
		<ToolbarItem>
			<Fa slot="icon" icon={faCopy} />
			<span slot="tooltip">Duplicate the file</span>
		</ToolbarItem>
		<ToolbarItem>
			<Fa slot="icon" icon={faMapMarkerAlt} />
			<span slot="tooltip">Create a new point of interest</span>
		</ToolbarItem>
		<ToolbarItem>
			<Fa slot="icon" icon={faCompressAlt} />
			<span slot="tooltip">Reduce the number of track points</span>
		</ToolbarItem>
		<ToolbarItem>
			<Fa slot="icon" icon={faVectorSquare} />
			<span slot="tooltip">Clean track points and POIs with a rectangle selection</span>
		</ToolbarItem>
		<ToolbarItem>
			<Fa slot="icon" icon={faEyeSlash} />
			<span slot="tooltip">Hide/unhide the trace</span>
		</ToolbarItem>
		<ToolbarItem>
			<Fa slot="icon" icon={faPalette} />
			<span slot="tooltip">Change the styling of the trace</span>
		</ToolbarItem>
		<ToolbarItem>
			<Fa slot="icon" icon={faFolderTree} />
			<span slot="tooltip">Manage the file structure</span>
		</ToolbarItem>
		<ToolbarItem>
			<Fa slot="icon" icon={faTrashAlt} />
			<span slot="tooltip">Delete the file</span>
		</ToolbarItem>
	</div>
</div>
