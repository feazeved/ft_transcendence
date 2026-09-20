// The ONE wordmark with the four card-colored bars under it, as in the design's
// header (sm), slim footer (md) and Home's big footer (lg). It is not a link: wrap it in one where needed.
const SIZES = {
	sm: { word: "text-[clamp(22px,5vw,28px)] tracking-[0.04em]", gap: "gap-3", bars: "gap-1", bar: "h-1.5 w-3.5" },
	md: { word: "text-2xl tracking-[0.02em]", gap: "gap-4", bars: "gap-[5px]", bar: "h-[7px] w-[26px]" },
	lg: { word: "text-[38px] tracking-[0.02em]", gap: "gap-4", bars: "gap-[5px]", bar: "h-2 w-[34px]" },
}

const BAR_COLORS = ["bg-red", "bg-blue", "bg-green", "bg-yellow"]

function BrandMark({ size = "sm", className = "" }) {
	const s = SIZES[size] ?? SIZES.sm
	return (
			<span className={`group flex items-center ${s.gap} ${className}`}>
				<span className={`font-logo font-extrabold text-white ${s.word}`}>ONE</span>
				<span aria-hidden="true" className={`flex ${s.bars}`}>
					{BAR_COLORS.map((color, i) => (
						<i
							key={color}
							className={`${s.bar} ${color} motion-safe:group-hover:animate-[wave_0.6s_ease-in-out_1]`}
							style={{ animationDelay: `${i * 0.1}s` }}
						/>
					))}
				</span>
			</span>
	)
}

export default BrandMark
