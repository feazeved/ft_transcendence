import TournamentCard from "@/components/tournament/TournamentCard.jsx"
import { EmptyMessage, ErrorMessage, Loading } from "@/components/ui/Message.jsx"

// The grid of tournaments, and the three things it says when there is no grid to
// draw. The page keeps the data and the selection; this file is only the shape of
// the list, so the page has no markup of its own.
function TournamentList({ tournaments, status, error, selectedId, onSelect }) {
	if (status === "loading") return <Loading className="py-12 text-center">Loading...</Loading>

	if (status === "error")
		return <ErrorMessage className="py-12 text-center">Couldn't load the tournaments. {error}</ErrorMessage>

	if (tournaments.length === 0)
		return <EmptyMessage className="py-12 text-center">No tournaments yet - create the first one.</EmptyMessage>

	return (
		<ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4">
			{tournaments.map((tournament) => (
				<TournamentCard
					key={tournament.id}
					tournament={tournament}
					selected={tournament.id === selectedId}
					onSelect={onSelect}
				/>
			))}
		</ul>
	)
}

export default TournamentList
