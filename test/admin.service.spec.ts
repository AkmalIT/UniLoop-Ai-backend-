import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClubApprovalStatus, OpportunityType } from '@prisma/client';
import { AdminService } from '../src/modules/admin/admin.service';

const pendingClub = {
  id: 'club-one',
  type: OpportunityType.CLUB,
  title: 'Frontend club',
  description: 'React va TypeScript amaliyoti',
  requiredSkills: ['React', 'TypeScript'],
  creatorStudentId: 'student-one',
  creatorStudent: { user: { name: 'Dilnoza Karimova' } },
  approvalStatus: ClubApprovalStatus.APPROVED,
  submittedAt: new Date('2026-09-19T10:00:00.000Z'),
  decidedAt: new Date('2026-09-19T10:01:00.000Z'),
  clubMemberships: [{ id: 'membership-one' }],
};

describe('AdminService club moderation', () => {
  function createService(overrides: Record<string, unknown> = {}) {
    const opportunity = {
      findFirst: jest.fn().mockResolvedValue({ id: pendingClub.id }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(pendingClub),
      ...overrides,
    };
    return {
      opportunity,
      service: new AdminService({ opportunity } as never),
    };
  }

  it('approves only a pending club and records the deciding administrator', async () => {
    const { service, opportunity } = createService();

    const result = await service.decideClub(
      pendingClub.id,
      'APPROVED',
      'admin-one',
    );

    expect(opportunity.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: pendingClub.id,
          type: OpportunityType.CLUB,
          approvalStatus: ClubApprovalStatus.PENDING,
        },
        data: expect.objectContaining({
          approvalStatus: ClubApprovalStatus.APPROVED,
          decidedByAdminId: 'admin-one',
        }),
      }),
    );
    expect(result).toMatchObject({
      id: pendingClub.id,
      status: ClubApprovalStatus.APPROVED,
      creatorName: 'Dilnoza Karimova',
      memberCount: 1,
    });
  });

  it('rejects a decision for a missing club', async () => {
    const { service } = createService({ findFirst: jest.fn().mockResolvedValue(null) });

    await expect(
      service.decideClub('missing-club', 'REJECTED', 'admin-one'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a stale concurrent decision', async () => {
    const { service } = createService({ updateMany: jest.fn().mockResolvedValue({ count: 0 }) });

    await expect(
      service.decideClub(pendingClub.id, 'REJECTED', 'admin-one'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
