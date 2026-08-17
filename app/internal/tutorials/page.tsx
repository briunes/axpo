"use client";

import { Box, Button, Chip, Divider, Stack, Typography } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { useRouter } from "next/navigation";
import { loadSession } from "../lib/authSession";
import { usePermissions } from "../lib/permissionsContext";
import { useI18n } from "@/lib/i18n-context";
import { canAccessTutorial, TUTORIALS } from "../components/tutorials/tutorialCatalog";
import { ManualDownloadMenu } from "./ManualDownloadMenu";

const categoryLabelKeys = { basics: "categoryBasics", simulations: "categorySimulations", management: "categoryManagement", administration: "categoryAdministration" } as const;

export default function TutorialsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const session = loadSession();
  const { canDo } = usePermissions();
  if (!session) return null;

  const available = TUTORIALS.filter((tutorial) =>
    canAccessTutorial(tutorial, session.user.role, canDo),
  );

  return (
    <Box data-tour="tutorial-catalog" sx={{ maxWidth: 1180, mx: "auto" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "flex-start" }}
        justifyContent="space-between"
        sx={{ mb: 4 }}
      >
        <Box>
          <Typography variant="h4" component="h1" fontWeight={700}>{t("tutorials", "catalogTitle")}</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {t("tutorials", "catalogSubtitle")}
          </Typography>
        </Box>
        <ManualDownloadMenu role={session.user.role} token={session.token} />
      </Stack>
      <Box
        sx={{
          bgcolor: "background.paper",
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          px: { xs: 2, sm: 2.5 },
        }}
      >
        {(["basics", "simulations", "management", "administration"] as const).map((category, categoryIndex) => {
          const tutorials = available.filter((tutorial) => tutorial.category === category);
          if (!tutorials.length) return null;
          return (
            <Box key={category} sx={{ py: 2 }}>
              {categoryIndex > 0 && <Divider sx={{ mb: 2 }} />}
              <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>{t("tutorials", categoryLabelKeys[category])}</Typography>
              <Box>
                {tutorials.map((tutorial, index) => (
                  <Box key={tutorial.id}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={{ xs: 1.5, sm: 2 }}
                      alignItems={{ xs: "stretch", sm: "center" }}
                      sx={{ py: 1.5 }}
                    >
                      <Chip
                        label={t("tutorials", "stepCount", { count: tutorial.steps.length + (tutorial.completionSteps?.length ?? 0) })}
                        size="small"
                        sx={{ alignSelf: { xs: "flex-start", sm: "center" }, flexShrink: 0 }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" component="h2" fontWeight={650}>{t("tutorials", tutorial.title)}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{t("tutorials", tutorial.description)}</Typography>
                      </Box>
                      <Button
                        variant="contained"
                        startIcon={<PlayArrowIcon />}
                        onClick={() => router.push(`${tutorial.route}?tutorial=${tutorial.id}`)}
                        sx={{ alignSelf: { xs: "flex-end", sm: "center" }, flexShrink: 0 }}
                      >
                        {t("tutorials", "startTutorial")}
                      </Button>
                    </Stack>
                    {index < tutorials.length - 1 && <Divider />}
                  </Box>
                ))}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
