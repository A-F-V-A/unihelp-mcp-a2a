import type { Routes } from '@angular/router';
import { RunDetail } from './corridas/run-detail/run-detail';
import { RunList } from './corridas/run-list/run-list';
import { ExecutionDetail } from './corridas/execution-detail/execution-detail';
import { ExperimentoShell } from './experimento-shell/experimento-shell';
import { RunPlanner } from './preparar/run-planner/run-planner';
import { ResultsPage } from './resultados/results-page/results-page';
import { TaskDetail } from './tareas/task-detail/task-detail';
import { TaskExplorer } from './tareas/task-explorer/task-explorer';

/**
 * Panel del experimento (HU-MET-09 a HU-MET-14). Se abre en Resultados porque
 * el semaforo de control es lo primero que hay que ver (HU-MET-10).
 */
export const EXPERIMENTO_ROUTES: Routes = [
  {
    path: '',
    component: ExperimentoShell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'resultados' },
      { path: 'resultados', component: ResultsPage, title: 'Resultados · Experimento UniHelp' },
      { path: 'corridas', component: RunList, title: 'Corridas · Experimento UniHelp' },
      { path: 'corridas/:nombre', component: RunDetail, title: 'Corrida · Experimento UniHelp' },
      {
        path: 'corridas/:nombre/ejecuciones/:runId',
        component: ExecutionDetail,
        title: 'Ejecución · Experimento UniHelp',
      },
      { path: 'tareas', component: TaskExplorer, title: 'Tareas · Experimento UniHelp' },
      { path: 'tareas/:id', component: TaskDetail, title: 'Tarea · Experimento UniHelp' },
      {
        path: 'preparar',
        component: RunPlanner,
        title: 'Correr una corrida · Experimento UniHelp',
      },
    ],
  },
];
