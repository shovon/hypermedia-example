export function Google() {
	return (
		<div
			ref={(ref) => {
				if (!ref) return;
				ref.innerHTML = `
					<div
						id="g_id_onload"
						data-client_id="531751812791-otsvs0djgo6j3hku1j3ojlso790s7vh8.apps.googleusercontent.com"
						data-context="use"
						data-ux_mode="popup"
						data-login_uri="http://localhost:3000/"
						data-auto_prompt="false"
					></div>

					<div
						className="g_id_signin"
						data-type="standard"
						data-shape="rectangular"
						data-theme="outline"
						data-text="continue_with"
						data-size="large"
						data-logo_alignment="left"
					></div>

					<script src="https://accounts.google.com/gsi/client" async defer></script>
				`;
			}}
		></div>
	);
}
