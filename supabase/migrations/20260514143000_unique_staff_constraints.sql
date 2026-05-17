-- Ensure unique constraints for ON CONFLICT (user_id) upserts
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

-- delivery_partners constraint requires cleanup first if duplicates exist
DELETE FROM public.delivery_partners a USING (
    SELECT MIN(id::text)::uuid as min_id, user_id
    FROM public.delivery_partners
    WHERE user_id IS NOT NULL
    GROUP BY user_id
    HAVING COUNT(*) > 1
) b
WHERE a.user_id = b.user_id AND a.id <> b.min_id;

ALTER TABLE public.delivery_partners DROP CONSTRAINT IF EXISTS delivery_partners_user_id_key;
ALTER TABLE public.delivery_partners ADD CONSTRAINT delivery_partners_user_id_key UNIQUE (user_id);
