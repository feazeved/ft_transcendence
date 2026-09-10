import { useId } from "react"
import { Link } from "react-router"

const Card = ({ title, description, image, to, className = "", height = "h-full", imageSize = "w-48 h-48" }) => {
	const headingId = useId()
	const content = (
		<article aria-labelledby={headingId} className={`cursor-pointer relative overflow-hidden bg-card text-card-foreground rounded-xl border border-border p-6 ${height} transition-transform duration-300 ease-in-out hover:scale-105 ${className}`}>
			<div className="relative z-10">
				<h2 id={headingId} className="text-2xl font-bold">{title}</h2>
				<p className="mt-2 text-muted-foreground">{description}</p>
			</div>
			{image && (
				<img
					src={image}
					alt={title}
					className={`mt-6 ml-auto ${imageSize} rotate-45 opacity-80`}
				/>
			)}
		</article>
	)

	if (!to) return content

	return (
		<Link to={to} className="block h-full">
			{content}
		</Link>
	)
}

export default Card
