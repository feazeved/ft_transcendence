import { useState } from "react"
import Avatar from "@/components/ui/Avatar.jsx"
import BrandMark from "@/components/ui/BrandMark.jsx"
import Button from "@/components/ui/Button.jsx"
import ButtonLink from "@/components/ui/ButtonLink.jsx"
import Dialog from "@/components/ui/Dialog.jsx"
import FormField from "@/components/ui/FormField.jsx"
import PageHeader from "@/components/ui/PageHeader.jsx"
import Panel from "@/components/ui/Panel.jsx"
import Stat from "@/components/ui/Stat.jsx"
import SwitchRow from "@/components/ui/SwitchRow.jsx"
import { EmptyMessage, ErrorMessage, Loading } from "@/components/ui/Message.jsx"

// Dev only — see routes.jsx. Every ui/ component on one page, so they can be
// checked against the design and with the keyboard without opening a real
// screen that may not exist yet.
const COLORS = ["red", "blue", "green", "yellow"]
const GOOD_PHOTO = "/profile/daniel.png"
const BROKEN_PHOTO = "/profile/does-not-exist.png"

function Row({ title, children }) {
	return (
		<section className="flex flex-col gap-3">
			<h2 className="font-mono text-[11px] tracking-[0.16em] text-muted">{title}</h2>
			<div className="flex flex-wrap items-center gap-3">{children}</div>
		</section>
	)
}

function UiPlayground() {
	const [text, setText] = useState("")
	const [size, setSize] = useState("4")
	const [jumpIn, setJumpIn] = useState(false)
	const [photo, setPhoto] = useState(BROKEN_PHOTO)
	const [open, setOpen] = useState(false)

	return (
		<div className="mx-auto flex w-full max-w-[1240px] flex-col gap-10 px-[clamp(16px,4vw,24px)] py-10">
			<PageHeader eyebrow="DEV" title="UI playground" count="12 COMPONENTS" />

			<Row title="BRANDMARK">
				<BrandMark />
				<BrandMark size="md" />
				<BrandMark size="lg" />
			</Row>

			<Row title="BUTTON · SOLID">
				{COLORS.map((color) => (
					<Button key={color} color={color}>{color.toUpperCase()}</Button>
				))}
				<Button disabled>DISABLED</Button>
			</Row>

			<Row title="BUTTON · OUTLINE">
				{COLORS.map((color) => (
					<Button key={color} variant="outline" color={color}>{color.toUpperCase()}</Button>
				))}
			</Row>

			<Row title="BUTTON · SMALL, AND BUTTONLINK">
				<Button variant="small">SMALL ACTION</Button>
				<ButtonLink to="/dev/ui" variant="small">SMALL LINK</ButtonLink>
				<ButtonLink to="/" color="green">GO HOME</ButtonLink>
			</Row>

			<Row title="PANEL AND STAT">
				<Panel title="RECORD" accent="green" className="w-[min(100%,360px)]">
					<dl className="flex flex-col gap-3.5">
						<Stat label="Games played" value="48" />
						<Stat label="Games won" value="30" color="green" />
						<Stat label="Win rate" value="62%" color="yellow" />
					</dl>
				</Panel>
				<Panel title="NO ACCENT" className="w-[min(100%,360px)]">
					<p className="text-[15px] text-white/70">A panel without a colored top border.</p>
				</Panel>
			</Row>

			<Row title="FORMFIELD AND SWITCHROW">
				<div className="flex w-[min(100%,360px)] flex-col gap-4">
					<FormField
						label="ROOM NAME"
						value={text}
						onChange={(e) => setText(e.target.value)}
						placeholder="Simba's table"
						hint={`${text.length}/30`}
						maxLength={30}
					/>
					<FormField label="WITH AN ERROR" value="" onChange={() => {}} error="That name is taken." />
					<FormField label="MAX PLAYERS" as="select" value={size} onChange={(e) => setSize(e.target.value)}>
						<option value="2">2</option>
						<option value="4">4</option>
						<option value="10">10</option>
					</FormField>
					<SwitchRow
						label="Jump in"
						hint="Play an identical card out of turn."
						checked={jumpIn}
						onChange={setJumpIn}
					/>
					<p className="font-mono text-[11px] text-muted">
						typed: "{text}" · seats: {size} · jump in: {jumpIn ? "on" : "off"}
					</p>
				</div>
			</Row>

			<Row title="AVATAR">
				<Avatar src={GOOD_PHOTO} name="daniel" size="xs" />
				<Avatar src={GOOD_PHOTO} name="daniel" size="sm" />
				<Avatar src={GOOD_PHOTO} name="daniel" size="md" ring="green" />
				<Avatar src={GOOD_PHOTO} name="daniel" size="lg" ring="yellow" />
				<Avatar src={photo} name="rita" size="md" />
				<Button variant="small" onClick={() => setPhoto(photo === GOOD_PHOTO ? BROKEN_PHOTO : GOOD_PHOTO)}>
					SWAP THAT PHOTO
				</Button>
			</Row>

			<Row title="MESSAGES">
				<Loading />
				<ErrorMessage>Could not reach the server.</ErrorMessage>
				<EmptyMessage>No finished games yet - be the first.</EmptyMessage>
			</Row>

			<Row title="DIALOG">
				<Button color="green" onClick={() => setOpen(true)}>OPEN DIALOG</Button>
				<Dialog open={open} onClose={() => setOpen(false)} title="Create a room">
					<FormField label="ROOM NAME" defaultValue="Simba's table" />
					<SwitchRow label="Seven swap" hint="A 7 may swap hands." checked onChange={() => {}} />
					<div className="flex flex-wrap gap-3">
						<Button color="green" onClick={() => setOpen(false)}>CREATE</Button>
						<Button variant="small" onClick={() => setOpen(false)}>CANCEL</Button>
					</div>
				</Dialog>
			</Row>
		</div>
	)
}

export default UiPlayground
