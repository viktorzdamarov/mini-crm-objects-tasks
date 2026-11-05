DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP TABLE IF EXISTS public.task_status_history CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.objects CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP FUNCTION IF EXISTS public.seed_demo CASCADE;
DROP FUNCTION IF EXISTS public.transition_task_status CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS public.current_user_role CASCADE;
DROP FUNCTION IF EXISTS public.is_assigner CASCADE;
DROP FUNCTION IF EXISTS public.can_read_object CASCADE;
DROP FUNCTION IF EXISTS public.can_read_task CASCADE;
DROP FUNCTION IF EXISTS public.prevent_direct_status_change CASCADE;
DROP FUNCTION IF EXISTS public.log_task_created_history CASCADE;
DROP FUNCTION IF EXISTS public.validate_task_roles CASCADE;
DROP FUNCTION IF EXISTS public.protect_task_immutable_fields CASCADE;
DROP FUNCTION IF EXISTS public.protect_profile_role CASCADE;

DROP TYPE IF EXISTS public.task_status;
DROP TYPE IF EXISTS public.user_role;

CREATE TYPE public.user_role AS ENUM ('assigner', 'executor');
CREATE TYPE public.task_status AS ENUM (
  'new',
  'in_progress',
  'on_review',
  'accepted',
  'revision'
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role public.user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES public.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT objects_name_not_empty CHECK (length(btrim(name)) > 0)
);

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id UUID NOT NULL REFERENCES public.objects (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  assignee_id UUID NOT NULL REFERENCES public.profiles (id),
  author_id UUID NOT NULL REFERENCES public.profiles (id),
  status public.task_status NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tasks_title_not_empty CHECK (length(btrim(title)) > 0)
);

CREATE TABLE public.task_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  from_status public.task_status,
  to_status public.task_status NOT NULL,
  changed_by UUID NOT NULL REFERENCES public.profiles (id),
  comment TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_object_id ON public.tasks (object_id);
CREATE INDEX idx_tasks_assignee_id ON public.tasks (assignee_id);
CREATE INDEX idx_tasks_status ON public.tasks (status);
CREATE INDEX idx_task_status_history_task_id ON public.task_status_history (task_id);

CREATE OR REPLACE FUNCTION public.validate_task_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.assignee_id AND p.role = 'executor'
  ) THEN
    RAISE EXCEPTION 'Исполнитель должен иметь роль executor';
  END IF;
  IF TG_OP = 'INSERT' AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.author_id AND p.role = 'assigner'
  ) THEN
    RAISE EXCEPTION 'Автор задачи должен быть постановщиком';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_validate_roles
  BEFORE INSERT OR UPDATE OF assignee_id ON public.tasks
  FOR EACH ROW
  EXECUTE PROCEDURE public.validate_task_roles();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.user_role, 'executor')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (
    NEW.role IS DISTINCT FROM OLD.role
    OR NEW.id IS DISTINCT FROM OLD.id
  ) THEN
    RAISE EXCEPTION 'Роль и идентификатор профиля менять нельзя';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_protect_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.protect_profile_role();

CREATE OR REPLACE FUNCTION public.is_assigner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'assigner'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.can_read_object(p_object_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_assigner()
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.object_id = p_object_id AND t.assignee_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.can_read_task(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_assigner()
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = p_task_id AND t.assignee_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.prevent_direct_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF current_setting('app.allow_status_change', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Смена статуса только через transition_task_status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_prevent_direct_status_change
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE PROCEDURE public.prevent_direct_status_change();

CREATE OR REPLACE FUNCTION public.protect_task_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    RAISE EXCEPTION 'Автора задачи менять нельзя';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Дату создания менять нельзя';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_protect_immutable
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE PROCEDURE public.protect_task_immutable_fields();

CREATE OR REPLACE FUNCTION public.transition_task_status(
  p_task_id UUID,
  p_new_status public.task_status,
  p_comment TEXT DEFAULT NULL
)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task public.tasks;
  v_role public.user_role;
  v_old public.task_status;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Не авторизован';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Профиль не найден';
  END IF;

  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Задача не найдена';
  END IF;

  v_old := v_task.status;

  IF v_old = p_new_status THEN
    RAISE EXCEPTION 'Статус уже %', p_new_status;
  END IF;

  IF v_old = 'new' AND p_new_status = 'in_progress' THEN
    IF v_role <> 'executor' OR v_task.assignee_id <> auth.uid() THEN
      RAISE EXCEPTION 'Недостаточно прав для перехода';
    END IF;
  ELSIF v_old = 'in_progress' AND p_new_status = 'on_review' THEN
    IF v_role <> 'executor' OR v_task.assignee_id <> auth.uid() THEN
      RAISE EXCEPTION 'Недостаточно прав для перехода';
    END IF;
  ELSIF v_old = 'on_review' AND p_new_status = 'accepted' THEN
    IF v_role <> 'assigner' THEN
      RAISE EXCEPTION 'Недостаточно прав для перехода';
    END IF;
  ELSIF v_old = 'on_review' AND p_new_status = 'revision' THEN
    IF v_role <> 'assigner' THEN
      RAISE EXCEPTION 'Недостаточно прав для перехода';
    END IF;
    IF p_comment IS NULL OR btrim(p_comment) = '' THEN
      RAISE EXCEPTION 'Комментарий обязателен при возврате на доработку';
    END IF;
  ELSIF v_old = 'revision' AND p_new_status = 'in_progress' THEN
    IF v_role <> 'executor' OR v_task.assignee_id <> auth.uid() THEN
      RAISE EXCEPTION 'Недостаточно прав для перехода';
    END IF;
  ELSE
    RAISE EXCEPTION 'Переход % -> % запрещён', v_old, p_new_status;
  END IF;

  PERFORM set_config('app.allow_status_change', 'true', true);

  UPDATE public.tasks
  SET status = p_new_status
  WHERE id = p_task_id
  RETURNING * INTO v_task;

  INSERT INTO public.task_status_history (
    task_id, from_status, to_status, changed_by, comment
  ) VALUES (
    p_task_id, v_old, p_new_status, auth.uid(), NULLIF(btrim(COALESCE(p_comment, '')), '')
  );

  RETURN v_task;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_task_created_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'new' THEN
    RAISE EXCEPTION 'Новая задача должна иметь статус new';
  END IF;
  INSERT INTO public.task_status_history (
    task_id, from_status, to_status, changed_by, comment
  ) VALUES (
    NEW.id, NULL, 'new', NEW.author_id, NULL
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_log_created
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE PROCEDURE public.log_task_created_history();

CREATE OR REPLACE FUNCTION public.seed_demo()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assigner UUID;
  v_ex1 UUID;
  v_ex2 UUID;
  v_o1 UUID;
  v_o2 UUID;
  v_o3 UUID;
BEGIN
  SELECT id INTO v_assigner FROM public.profiles WHERE role = 'assigner' ORDER BY created_at LIMIT 1;
  SELECT id INTO v_ex1 FROM public.profiles WHERE role = 'executor' ORDER BY created_at LIMIT 1;
  SELECT id INTO v_ex2 FROM public.profiles WHERE role = 'executor' ORDER BY created_at OFFSET 1 LIMIT 1;

  IF v_assigner IS NULL OR v_ex1 IS NULL OR v_ex2 IS NULL THEN
    RAISE EXCEPTION 'Нужны минимум 1 постановщик и 2 исполнителя в profiles';
  END IF;

  DELETE FROM public.objects WHERE id IS NOT NULL;

  INSERT INTO public.objects (name, address, created_by)
  VALUES ('ЖК «Северный»', 'ул. Строителей, 1', v_assigner)
  RETURNING id INTO v_o1;

  INSERT INTO public.objects (name, address, created_by)
  VALUES ('Склад №3', 'пр. Промышленный, 12', v_assigner)
  RETURNING id INTO v_o2;

  INSERT INTO public.objects (name, address, created_by)
  VALUES ('Офис продаж', 'ул. Центральная, 5', v_assigner)
  RETURNING id INTO v_o3;

  INSERT INTO public.tasks (object_id, title, description, assignee_id, author_id)
  VALUES
    (v_o1, 'Разбить оси корпуса А', 'Вынести оси на площадку, акт с геодезистом.', v_ex1, v_assigner),
    (v_o1, 'Проверить арматуру перекрытия', 'Сверить с проектом, фотофиксация.', v_ex1, v_assigner),
    (v_o2, 'Инвентаризация инструмента', 'Сверить ведомость склада с фактом.', v_ex2, v_assigner),
    (v_o2, 'Устранить протечку в рампе', 'Локализовать и закрыть замечание.', v_ex2, v_assigner),
    (v_o3, 'Подготовить помещение к сдаче', 'Мелкий ремонт, уборка, чек-лист.', v_ex2, v_assigner);

  PERFORM set_config('app.allow_status_change', 'true', true);

  UPDATE public.tasks SET status = 'in_progress'
  WHERE title = 'Проверить арматуру перекрытия';
  INSERT INTO public.task_status_history (task_id, from_status, to_status, changed_by)
  SELECT id, 'new', 'in_progress', v_ex1 FROM public.tasks WHERE title = 'Проверить арматуру перекрытия';

  UPDATE public.tasks SET status = 'on_review'
  WHERE title = 'Инвентаризация инструмента';
  INSERT INTO public.task_status_history (task_id, from_status, to_status, changed_by)
  SELECT id, 'new', 'in_progress', v_ex2 FROM public.tasks WHERE title = 'Инвентаризация инструмента';
  INSERT INTO public.task_status_history (task_id, from_status, to_status, changed_by)
  SELECT id, 'in_progress', 'on_review', v_ex2 FROM public.tasks WHERE title = 'Инвентаризация инструмента';

  UPDATE public.tasks SET status = 'accepted'
  WHERE title = 'Устранить протечку в рампе';
  INSERT INTO public.task_status_history (task_id, from_status, to_status, changed_by)
  SELECT id, 'new', 'in_progress', v_ex2 FROM public.tasks WHERE title = 'Устранить протечку в рампе';
  INSERT INTO public.task_status_history (task_id, from_status, to_status, changed_by)
  SELECT id, 'in_progress', 'on_review', v_ex2 FROM public.tasks WHERE title = 'Устранить протечку в рампе';
  INSERT INTO public.task_status_history (task_id, from_status, to_status, changed_by, comment)
  SELECT id, 'on_review', 'accepted', v_assigner, 'Принято, замечаний нет'
  FROM public.tasks WHERE title = 'Устранить протечку в рампе';

  UPDATE public.tasks SET status = 'revision'
  WHERE title = 'Подготовить помещение к сдаче';
  INSERT INTO public.task_status_history (task_id, from_status, to_status, changed_by)
  SELECT id, 'new', 'in_progress', v_ex2 FROM public.tasks WHERE title = 'Подготовить помещение к сдаче';
  INSERT INTO public.task_status_history (task_id, from_status, to_status, changed_by)
  SELECT id, 'in_progress', 'on_review', v_ex2 FROM public.tasks WHERE title = 'Подготовить помещение к сдаче';
  INSERT INTO public.task_status_history (task_id, from_status, to_status, changed_by, comment)
  SELECT id, 'on_review', 'revision', v_assigner, 'Не закрыты плинтуса в переговорной, переделать'
  FROM public.tasks WHERE title = 'Подготовить помещение к сдаче';

  RETURN 'Демо: 3 объекта, 5 задач во всех статусах';
END;
$$;

REVOKE ALL ON FUNCTION public.seed_demo() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo() TO postgres, service_role;

GRANT USAGE ON SCHEMA public TO authenticated, anon;

REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.objects FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.tasks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.task_status_history FROM PUBLIC, anon, authenticated;

GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.objects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks TO authenticated;
GRANT SELECT ON TABLE public.task_status_history TO authenticated;

GRANT EXECUTE ON FUNCTION public.transition_task_status(uuid, public.task_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_assigner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_object(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_task(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.transition_task_status(uuid, public.task_status, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY objects_select ON public.objects
  FOR SELECT TO authenticated
  USING (public.can_read_object(id));

CREATE POLICY objects_insert ON public.objects
  FOR INSERT TO authenticated
  WITH CHECK (public.is_assigner() AND created_by = auth.uid());

CREATE POLICY objects_update ON public.objects
  FOR UPDATE TO authenticated
  USING (public.is_assigner())
  WITH CHECK (public.is_assigner());

CREATE POLICY objects_delete ON public.objects
  FOR DELETE TO authenticated
  USING (public.is_assigner());

CREATE POLICY tasks_select ON public.tasks
  FOR SELECT TO authenticated
  USING (public.can_read_task(id));

CREATE POLICY tasks_insert ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_assigner()
    AND author_id = auth.uid()
    AND status = 'new'
  );

CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE TO authenticated
  USING (public.is_assigner())
  WITH CHECK (public.is_assigner());

CREATE POLICY tasks_delete ON public.tasks
  FOR DELETE TO authenticated
  USING (public.is_assigner());

CREATE POLICY history_select ON public.task_status_history
  FOR SELECT TO authenticated
  USING (public.can_read_task(task_id));

COMMENT ON TABLE public.objects IS 'Строительные объекты (стройки)';
COMMENT ON TABLE public.tasks IS 'Задачи по объектам. Статус меняется только через transition_task_status';
COMMENT ON TABLE public.task_status_history IS 'Неизменяемый журнал смен статуса';
COMMENT ON FUNCTION public.transition_task_status IS 'Единственный легальный способ сменить статус задачи';
