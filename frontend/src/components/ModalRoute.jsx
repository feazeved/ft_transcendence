import { useNavigate } from "react-router"
import Modal from "./Modal.jsx"

// Glue between the router and <Modal>. routes.jsx renders a page inside this
// wrapper only when we arrived through a "background location" navigation
// (a <Link> that set `state={{ background: location }}`). Closing the modal
// just steps back in history, revealing the page that was underneath.
const ModalRoute = ({ title, children }) => {
	const navigate = useNavigate()
	return (
		<Modal open title={title} onClose={() => navigate(-1)}>
			{children}
		</Modal>
	)
}

export default ModalRoute
