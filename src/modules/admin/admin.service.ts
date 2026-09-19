import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ClubApprovalStatus, OpportunityType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [students, professors, clubs] = await Promise.all([
      this.prisma.studentProfile.findMany({
        include: { user: true },
        orderBy: { user: { name: 'asc' } },
      }),
      this.prisma.professorProfile.findMany({
        include: { user: true },
        orderBy: { user: { name: 'asc' } },
      }),
      this.prisma.opportunity.findMany({
        where: { type: OpportunityType.CLUB },
        include: { creatorStudent: { include: { user: true } }, clubMemberships: true },
        orderBy: { submittedAt: 'desc' },
      }),
    ]);

    const mapPerson = (person: typeof students[number] | typeof professors[number]) => ({
      id: person.id,
      fullName: person.user.name,
      role: person.user.role,
      university: 'university' in person ? person.university ?? '' : '',
      faculty: 'faculty' in person ? person.faculty ?? '' : person.department ?? '',
      avatarLabel: person.user.name.split(' ').map((part) => part[0]).slice(0, 2).join(''),
      universityId: 'universityId' in person ? person.universityId : null,
      facultyId: null,
    });
    const mappedClubs = clubs.map((club) => ({
      id: club.id,
      title: club.title,
      description: club.description,
      topic: club.requiredSkills.join(', ') || 'Universitet klubi',
      skills: club.requiredSkills,
      creatorId: club.creatorStudentId,
      creatorName: club.creatorStudent?.user.name ?? 'Universitet hamjamiyati',
      status: club.approvalStatus,
      submittedAt: club.submittedAt.toISOString(),
      decidedAt: club.decidedAt?.toISOString() ?? null,
      memberCount: club.clubMemberships.length,
    }));
    return {
      students: students.map(mapPerson),
      professors: professors.map(mapPerson),
      clubs: mappedClubs,
      stats: {
        totalStudents: students.length,
        totalProfessors: professors.length,
        pendingClubs: mappedClubs.filter((club) => club.status === 'PENDING').length,
        approvedClubs: mappedClubs.filter((club) => club.status === 'APPROVED').length,
        rejectedClubs: mappedClubs.filter((club) => club.status === 'REJECTED').length,
      },
    };
  }

  async decideClub(id: string, status: 'APPROVED' | 'REJECTED') {
    const club = await this.prisma.opportunity.findFirst({
      where: { id, type: OpportunityType.CLUB },
      include: { creatorStudent: { include: { user: true } }, clubMemberships: true },
    });
    if (!club) throw new NotFoundException('Club not found.');
    if (club.approvalStatus !== ClubApprovalStatus.PENDING)
      throw new ConflictException('Club has already been decided.');
    const updated = await this.prisma.opportunity.update({
      where: { id },
      data: { approvalStatus: status as ClubApprovalStatus, decidedAt: new Date() },
      include: { creatorStudent: { include: { user: true } }, clubMemberships: true },
    });
    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      topic: updated.requiredSkills.join(', ') || 'Universitet klubi',
      skills: updated.requiredSkills,
      creatorId: updated.creatorStudentId,
      creatorName: updated.creatorStudent?.user.name ?? 'Universitet hamjamiyati',
      status: updated.approvalStatus,
      submittedAt: updated.submittedAt.toISOString(),
      decidedAt: updated.decidedAt?.toISOString() ?? null,
      memberCount: updated.clubMemberships.length,
    };
  }
}
