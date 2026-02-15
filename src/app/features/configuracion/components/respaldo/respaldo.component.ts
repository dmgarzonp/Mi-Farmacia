import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackupService } from '../../../../core/services/backup.service';
import { AlertService } from '../../../../shared/components/alert/alert.component';
import { ConfirmService } from '../../../../shared/services/confirm.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';

@Component({
    selector: 'app-respaldo',
    standalone: true,
    imports: [CommonModule, ButtonComponent, SafeHtmlPipe],
    templateUrl: './respaldo.component.html'
})
export class RespaldoComponent {
    private backupService = inject(BackupService);
    private alertService = inject(AlertService);
    private confirmService = inject(ConfirmService);

    icons = APP_ICONS;
    loadingBackup = signal(false);
    loadingRestore = signal(false);

    get isAvailable(): boolean {
        return this.backupService.isAvailable;
    }

    async crearRespaldo(): Promise<void> {
        if (!this.isAvailable) {
            this.alertService.warning('Los respaldos solo están disponibles en la aplicación de escritorio (Electron).');
            return;
        }
        this.loadingBackup.set(true);
        try {
            const result = await this.backupService.createBackup();
            if (result.success) {
                this.alertService.success(`Respaldo creado correctamente en: ${result.path || ''}`);
            } else if (result.error && result.error !== 'Cancelado') {
                this.alertService.error(result.error);
            }
        } finally {
            this.loadingBackup.set(false);
        }
    }

    async restaurar(): Promise<void> {
        if (!this.isAvailable) {
            this.alertService.warning('La restauración solo está disponible en la aplicación de escritorio (Electron).');
            return;
        }
        const confirmado = await this.confirmService.ask({
            title: 'Restaurar base de datos',
            message: 'Se reemplazará la base de datos actual por el archivo que seleccione. La aplicación se reiniciará. ¿Desea continuar?',
            confirmText: 'Sí, restaurar',
            cancelText: 'Cancelar',
            variant: 'danger'
        });
        if (!confirmado) return;
        this.loadingRestore.set(true);
        try {
            const result = await this.backupService.restoreBackup();
            if (result.success) {
                this.alertService.success('Restauración iniciada. La aplicación se reiniciará.');
            } else if (result.error && result.error !== 'Cancelado') {
                this.alertService.error(result.error);
            }
        } finally {
            this.loadingRestore.set(false);
        }
    }
}
