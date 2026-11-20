import { HttpError } from '@fish-tank/service-core';
import { cropTransparentPng } from './image.js';

export async function publishDrawing({ userId, submissionId, name, image, repository, moderator, logger = console }) {
  const creator = await repository.getCreator(userId);
  const previous = await repository.findFish(submissionId, userId);
  if (previous) return { fish: previous, creator, replayed: true };

  const sprite = await cropTransparentPng(image);
  const moderation = await moderator.check(sprite.buffer);
  if (!moderation.approved) throw new HttpError(422, 'DRAWING_REJECTED', 'Este dibujo no puede publicarse. Modifícalo y vuelve a intentarlo.');
  const path = `${userId}/${submissionId}.png`;
  let imageUrl;
  try { imageUrl = await repository.upload(path, sprite.buffer); }
  catch (error) {
    if (error.code === 'SUBMISSION_PENDING') {
      const completed = await repository.findFish(submissionId, userId);
      if (completed) return { fish: completed, creator, replayed: true };
    }
    throw error;
  }

  let fish;
  try { fish = await repository.insertFish({ id: submissionId, name, image_url: imageUrl, creator_id: userId }); }
  catch (error) {
    // Un timeout no prueba que el INSERT falló. Consultar antes de compensar.
    let persisted;
    try { persisted = await repository.findFish(submissionId, userId); }
    catch {
      logger.error('Estado de publicación incierto; conservar sprite para reconciliación.', { submissionId });
      throw error;
    }
    if (persisted) return { fish: persisted, creator, replayed: true };
    try { await repository.removeSprite(path); }
    catch { logger.error('Sprite pendiente de limpieza tras fallo de base de datos.', { path }); }
    throw error;
  }
  return { fish, creator, sprite: { width: sprite.width, height: sprite.height }, moderation, replayed: false };
}
