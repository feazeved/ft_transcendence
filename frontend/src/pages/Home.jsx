import Hero from "@/components/home/Hero.jsx"
import HouseRules from "@/components/home/HouseRules.jsx"
import HowToPlay from "@/components/home/HowToPlay.jsx"
import OpenRooms from "@/components/home/OpenRooms.jsx"
import TopFive from "@/components/home/TopFive.jsx"
import TournamentBanner from "@/components/home/TournamentBanner.jsx"

// The hub. It holds no state and fetches nothing: each section asks `lib/` for
// what it needs, so this file only says what comes after what.
function Home() {
	return (
		<>
			<Hero />
			<OpenRooms />
			<TournamentBanner />
			<TopFive />
			<HowToPlay />
			<HouseRules />
		</>
	)
}

export default Home
