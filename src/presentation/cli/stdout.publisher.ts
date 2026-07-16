import { Injectable } from '@nestjs/common';
import { ResultPublisher } from '@core/conversion';

/** CLI implementation of the outbound port. An HrmWebhookPublisher would be a drop-in. */
@Injectable()
export class StdoutPublisher implements ResultPublisher {
  readonly target = 'stdout';

  async publish(rendered: string): Promise<void> {
    process.stdout.write(rendered + '\n');
  }
}
