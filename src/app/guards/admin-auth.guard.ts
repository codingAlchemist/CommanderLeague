import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AdminAuthService } from '../services/admin-auth.service';

export const adminAuthGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  const adminAuthService = inject(AdminAuthService);

  if (adminAuthService.isAdmin()) {
    return true;
  }

  return router.createUrlTree(['/admin-login'], {
    queryParams: { redirectTo: state.url },
  });
};
