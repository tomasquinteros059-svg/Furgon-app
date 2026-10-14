-- =============================================================================
-- Mi perfil: foto de la tía o la familia.
-- La foto vive en el bucket privado «fotos-perfil», en una carpeta con el id de su dueño;
-- en perfiles.foto se guarda esa ruta. Cada uno solo cambia la suya.
-- =============================================================================

alter table public.perfiles
  add column foto text check (foto is null or (length(foto) <= 200 and foto like id::text || '/%'));
grant update (foto) on public.perfiles to authenticated;

-- Bucket privado (solo en Supabase; en las pruebas no existe el esquema storage).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('fotos-perfil', 'fotos-perfil', false) on conflict (id) do nothing;
    -- Subir, cambiar y borrar: solo en la carpeta propia.
    execute $p$create policy "sube su foto de perfil" on storage.objects for insert to authenticated
      with check (bucket_id = 'fotos-perfil' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy "cambia su foto de perfil" on storage.objects for update to authenticated
      using (bucket_id = 'fotos-perfil' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy "borra su foto de perfil" on storage.objects for delete to authenticated
      using (bucket_id = 'fotos-perfil' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    -- Ver: la propia, la de alguien del mismo furgón (misma empresa) o de una conexión aceptada.
    execute $p$create policy "ve fotos de perfil cercanas" on storage.objects for select to authenticated
      using (bucket_id = 'fotos-perfil' and (
        (storage.foldername(name))[1] = auth.uid()::text
        or exists (select 1 from public.perfiles p where p.id::text = (storage.foldername(name))[1]
                   and p.empresa_id is not null and p.empresa_id = public.mi_empresa())
        or exists (select 1 from public.conexiones c where c.estado = 'aceptada'
                   and ((c.apoderado_id = auth.uid() and c.conductor_id::text = (storage.foldername(name))[1])
                     or (c.conductor_id = auth.uid() and c.apoderado_id::text = (storage.foldername(name))[1])))
      ))$p$;
  end if;
end $$;
