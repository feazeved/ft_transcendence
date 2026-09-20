import Panel from "@/components/ui/Panel.jsx"
import Stat from "@/components/ui/Stat.jsx"

// Read-only numbers straight off the server. A dash means they haven't loaded,
// which is not the same as a real zero.
function RecordPanel({ stats }) {
	return (
		<Panel title="RECORD" accent="green">
			<dl className="flex flex-col gap-[18px]">
				<Stat label="Number of Triumphs" value={stats?.games_won ?? "—"} color="green" />
				<Stat label="Number of Humiliations" value={stats?.games_lost ?? "—"} color="red" />
				<Stat label="Win rate" value={stats ? `${stats.win_rate} %` : "—"} />
			</dl>
		</Panel>
	)
}

export default RecordPanel
