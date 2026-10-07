-- Datos de demostración para los revisores de Google Play y App Store.
-- Antes de ejecutarlo se fijan los ids de las dos cuentas (ver scripts/crear-cuentas-revision.mjs):
--   select set_config('demo.tia', '<uuid>', false), set_config('demo.familia', '<uuid>', false);
-- Es idempotente: si la empresa de demostración ya existe, la borra y la vuelve a crear.
do $$
declare
  v_tia uuid := current_setting('demo.tia')::uuid;
  v_familia uuid := current_setting('demo.familia')::uuid;
  v_empresa uuid;
  v_furgon uuid;
  v_ida uuid;
  v_vuelta uuid;
  v_alumno uuid;
  v_domicilio uuid;
  v_orden integer := 0;
  r record;
begin
  delete from public.empresas where nombre = 'Furgón Demo (revisión)';
  insert into public.empresas (nombre, mensualidad_defecto, telefono_contacto)
    values ('Furgón Demo (revisión)', 65000, '+56912345678') returning id into v_empresa;

  insert into public.perfiles (id, empresa_id, rol, nombre, telefono, puede_administrar)
    values (v_tia, v_empresa, 'conductor', 'Tía Demo', '+56912345678', true)
    on conflict (id) do update set empresa_id = excluded.empresa_id, rol = excluded.rol, nombre = excluded.nombre,
      telefono = excluded.telefono, puede_administrar = true;
  insert into public.perfiles (id, empresa_id, rol, nombre, telefono)
    values (v_familia, v_empresa, 'apoderado', 'Familia Demo', '+56987654321')
    on conflict (id) do update set empresa_id = excluded.empresa_id, rol = excluded.rol, nombre = excluded.nombre, telefono = excluded.telefono;

  insert into public.licencias (conductor_id, empresa_id, numero, clase, vence_en, estado, revisada_en)
    values (v_tia, v_empresa, 'DEMO-0001', 'A3', (now() + interval '2 years')::date, 'aprobada', now());

  insert into public.furgones (empresa_id, patente, modelo, capacidad, conductor_id)
    values (v_empresa, 'DEMO-11', 'Hyundai H1', 12, v_tia) returning id into v_furgon;

  -- Colegio y casas de ejemplo en Ñuñoa / Providencia (Santiago).
  insert into public.rutas (empresa_id, nombre, tipo, furgon_id, conductor_id, colegio_nombre, colegio_lat, colegio_lng, hora_salida)
    values (v_empresa, 'Mañana', 'ida', v_furgon, v_tia, 'Colegio Demo', -33.4542, -70.6005, '07:00') returning id into v_ida;
  insert into public.rutas (empresa_id, nombre, tipo, furgon_id, conductor_id, colegio_nombre, colegio_lat, colegio_lng, hora_salida)
    values (v_empresa, 'Tarde', 'vuelta', v_furgon, v_tia, 'Colegio Demo', -33.4542, -70.6005, '16:30') returning id into v_vuelta;

  for r in select * from (values
    ('Sofía Demo', '3° Básico', 'Av. Pedro de Valdivia 900, Providencia', -33.4410, -70.6110, true),
    ('Tomás Demo', '1° Básico', 'Av. Pedro de Valdivia 900, Providencia', -33.4410, -70.6110, true),
    ('Isidora Rojas', '5° Básico', 'Av. Ossa 1200, La Reina', -33.4470, -70.5790, false),
    ('Benjamín Muñoz', '2° Básico', 'Irarrázaval 3500, Ñuñoa', -33.4545, -70.5960, false)
  ) as t(nombre, curso, direccion, lat, lng, de_la_familia)
  loop
    v_orden := v_orden + 1;
    insert into public.alumnos (empresa_id, nombre, colegio, curso) values (v_empresa, r.nombre, 'Colegio Demo', r.curso) returning id into v_alumno;
    insert into public.domicilios (alumno_id, direccion, lat, lng) values (v_alumno, r.direccion, r.lat, r.lng) returning id into v_domicilio;
    insert into public.ruta_paradas (ruta_id, alumno_id, domicilio_id, orden) values (v_ida, v_alumno, v_domicilio, v_orden), (v_vuelta, v_alumno, v_domicilio, v_orden);
    if r.de_la_familia then
      insert into public.apoderado_alumno (apoderado_id, alumno_id, parentesco) values (v_familia, v_alumno, 'mamá');
      insert into public.contactos (alumno_id, nombre, telefono, prioridad, apoderado_id) values (v_alumno, 'Familia Demo', '+56987654321', 1, v_familia);
    else
      insert into public.contactos (alumno_id, nombre, telefono, prioridad) values (v_alumno, 'Apoderado ' || r.nombre, '+5698000000' || v_orden, 1);
    end if;
  end loop;
end
$$;
