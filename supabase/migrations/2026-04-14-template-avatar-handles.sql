-- Phase E.10 — Correct LinkedIn handles for curated template avatars
-- unavatar.io/linkedin/<handle> uses the exact /in/<slug> from the profile URL.

update writing_template set avatar_url = 'https://unavatar.io/linkedin/jakezward'             where id = 'jake-ward';
update writing_template set avatar_url = 'https://unavatar.io/linkedin/alexhormozi'           where id = 'alex-hormozi';
update writing_template set avatar_url = 'https://unavatar.io/linkedin/mattgray1'             where id = 'matt-gray';
update writing_template set avatar_url = 'https://unavatar.io/linkedin/laraacostar'           where id = 'lara-acosta';
update writing_template set avatar_url = 'https://unavatar.io/linkedin/nivedita-verma-ossian' where id = 'nivi-default';
