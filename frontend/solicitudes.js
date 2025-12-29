document.addEventListener('DOMContentLoaded', () => {

  cargarSolicitudes();

  function cargarSolicitudes() {
    fetch('/solicitudes/almacen/lista', { credentials: 'include' })
      .then(r => r.json())
      .then(data => renderLista(data));
  }

  function renderLista(lista) {
    const cont = document.getElementById('lista');
    cont.innerHTML = '';

    if (lista.length === 0) {
      cont.innerHTML = '<p>No hay solicitudes enviadas</p>';
      return;
    }

    lista.forEach(s => {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `
        <strong>Solicitud #${s.id}</strong><br>
        Proyecto: ${s.proyecto_id}<br>
        Estado: ${s.estado}<br><br>
        <button onclick="verDetalle(${s.id})">Ver detalle</button>
        <button onclick="surtir(${s.id})">Surtir</button>
      `;
      cont.appendChild(div);
    });
  }

  window.verDetalle = function (id) {
    fetch(`/solicitudes/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        let txt = 'Detalle:\n\n';
        data.forEach(d => {
          txt += `${d.nombre} - ${d.cantidad}\n`;
        });
        alert(txt);
      });
  };

  window.surtir = function (id) {
    if (!confirm('¿Surtir esta solicitud y descontar stock?')) return;

    fetch(`/solicitudes/almacen/surtir/${id}`, {
      method: 'POST',
      credentials: 'include'
    })
    .then(() => cargarSolicitudes());
  };

});
