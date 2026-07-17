ALTER TABLE "system_config"
ALTER COLUMN "appVersion" SET DEFAULT '0.2.1';

UPDATE "system_config"
SET
  "appVersion" = '0.2.1',
  "appChangelog" = jsonb_build_array(
    jsonb_build_object(
      'version', '0.2.1',
      'title', 'Updated from 0.2.0 to 0.2.1',
      'publishedAt', '2026-07-10T11:00:00.000Z',
      'notes', jsonb_build_array(
        'Added profile-aware indexed electricity prices so NORMAL and DIURNO load profiles use their own monthly base values.',
        'Improved AXPO Excel parsing to extract profile prices from INPUT OMIE formulas, intermediate cells and averaged formula ranges.',
        'Added simulation-detail access to download the Excel file used by the selected or calculated base-value set.',
        'Moved What''s new into the side menu, added the full changelog page and allowed the changelog during maintenance mode.'
      ),
      'notesByLanguage', jsonb_build_object(
        'en', jsonb_build_array(
          'Added profile-aware indexed electricity prices so NORMAL and DIURNO load profiles use their own monthly base values.',
          'Improved AXPO Excel parsing to extract profile prices from INPUT OMIE formulas, intermediate cells and averaged formula ranges.',
          'Added simulation-detail access to download the Excel file used by the selected or calculated base-value set.',
          'Moved What''s new into the side menu, added the full changelog page and allowed the changelog during maintenance mode.'
        ),
        'es', jsonb_build_array(
          'Se añadieron precios indexados de electricidad por perfil para que NORMAL y DIURNO usen sus propios valores base mensuales.',
          'Se mejoró el parser de Excel de AXPO para extraer precios por perfil desde fórmulas de INPUT OMIE, celdas intermedias y rangos promediados.',
          'Se añadió en el detalle de simulación la descarga del Excel usado por el conjunto de valores base seleccionado o calculado.',
          'Se movió Novedades al menú lateral, se añadió la página completa de changelog y se permitió consultarla durante el modo mantenimiento.'
        ),
        'fr', jsonb_build_array(
          'Ajout de prix d''électricité indexés par profil afin que NORMAL et DIURNO utilisent leurs propres valeurs de base mensuelles.',
          'Amélioration du parseur Excel AXPO pour extraire les prix par profil depuis les formules INPUT OMIE, les cellules intermédiaires et les plages moyennées.',
          'Ajout du téléchargement, depuis le détail de simulation, du fichier Excel utilisé par l''ensemble de valeurs de base sélectionné ou calculé.',
          'Déplacement de Nouveautés dans le menu latéral, ajout de la page complète de changelog et accès autorisé pendant le mode maintenance.'
        ),
        'pt', jsonb_build_array(
          'Adicionados preços indexados de eletricidade por perfil para que NORMAL e DIURNO usem os seus próprios valores base mensais.',
          'Melhorado o parser Excel da AXPO para extrair preços por perfil a partir de fórmulas INPUT OMIE, células intermédias e intervalos com média.',
          'Adicionado no detalhe da simulação o download do Excel usado pelo conjunto de valores base selecionado ou calculado.',
          'Movido o Novidades para o menu lateral, adicionada a página completa de changelog e permitido o acesso durante o modo de manutenção.'
        )
      )
    )
  ) || COALESCE(
    (
      SELECT jsonb_agg(entry)
      FROM jsonb_array_elements(COALESCE("appChangelog", '[]'::jsonb)) AS entry
      WHERE entry->>'version' <> '0.2.1'
    ),
    '[]'::jsonb
  ),
  "updatedAt" = CURRENT_TIMESTAMP;
