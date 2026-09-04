import { useNavigate } from "react-router"
import Modal from "./Modal.jsx"

const ModalRoute = ({ title, children }) => {
	const navigate = useNavigate()
	return (
		<Modal open title={title} onClose={() => navigate(-1)}>
			{children}
		</Modal>
	)
}

export default ModalRoute
