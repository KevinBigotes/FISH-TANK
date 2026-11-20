import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link } from 'react-router-dom';
import { drawingJoinUrl } from '../aquarium/model.js';

export function JoinAquarium() {
  const dialog = useRef(null), enlarge = useRef(null);
  const [open, setOpen] = useState(false);
  const url = drawingJoinUrl(window.location);
  const localOnly = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  useEffect(() => {
    if (open) dialog.current.showModal(); else if (dialog.current.open) dialog.current.close();
  }, [open]);
  function close() { setOpen(false); enlarge.current?.focus(); }
  return <>
    <aside className="join-aquarium" aria-label="Únete con tu teléfono">
      <div className="join-qr"><QRCodeSVG value={url} size={132} level="M" marginSize={4} fgColor="#103936" title="Código QR para dibujar tu pez" /></div>
      <div><p className="join-caption">ESTE OCÉANO TAMBIÉN ES TUYO</p><p className="join-invitation">¡Escanea y dibuja tu pez para soltarlo aquí!</p>
        <button ref={enlarge} type="button" onClick={() => setOpen(true)} className="join-enlarge">Ampliar código QR</button></div>
    </aside>
    <dialog ref={dialog} className="qr-dialog" aria-labelledby="qr-title" onCancel={close} onClose={close} onClick={(event) => { if (event.target === dialog.current) close(); }}>
      <div className="qr-dialog-content"><button type="button" className="qr-close" aria-label="Cerrar código QR" onClick={close}>×</button>
        <p className="eyebrow text-teal">DE TU TELÉFONO AL ARRECIFE</p><h2 id="qr-title">Dale vida a este océano.</h2>
        <QRCodeSVG value={url} size={360} level="M" marginSize={4} fgColor="#103936" title="Código QR ampliado para dibujar" />
        <p>¡Escanea y dibuja tu pez para soltarlo aquí!</p>
        {localOnly && <p className="qr-local-note">Para escanear desde otro dispositivo, inicia el modo de red local y abre la dirección de tu PC antes de mostrar este QR.</p>}
        <Link to="/dibujar" className="text-link" onClick={close}>Dibujar en este dispositivo</Link>
      </div>
    </dialog>
  </>;
}
