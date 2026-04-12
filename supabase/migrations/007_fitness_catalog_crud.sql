-- Add UPDATE and DELETE policies to fitness catalog tables
-- Previously only SELECT and INSERT were allowed, blocking plan editing

CREATE POLICY "Authenticated update" ON programs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete" ON programs FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated update" ON program_phases FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete" ON program_phases FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated update" ON program_days FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete" ON program_days FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated update" ON program_exercises FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete" ON program_exercises FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated update" ON program_principles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete" ON program_principles FOR DELETE TO authenticated USING (true);
