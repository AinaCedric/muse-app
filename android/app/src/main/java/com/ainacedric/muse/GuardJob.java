package com.ainacedric.muse;

import android.app.job.JobParameters;
import android.app.job.JobService;

/** Tâche périodique du système : relance le garde-fou même si les alarmes ont été supprimées. */
public class GuardJob extends JobService {
    @Override
    public boolean onStartJob(JobParameters p) {
        Guard.check(this);
        return false;
    }

    @Override
    public boolean onStopJob(JobParameters p) { return true; }
}
